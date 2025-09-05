from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
import os
from dotenv import load_dotenv
from typing import List, Dict, Any
import uuid
import math
from typing import Tuple
from contextlib import suppress
from pydantic import BaseModel, Field
from datetime import datetime
import json
from typing import Optional

from database import get_db, create_tables, AsyncSessionLocal
from models import VideoUpload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Load environment variables
load_dotenv()

app = FastAPI(title="Backend API", version="1.0.0")

print(os.getenv('AWS_ACCESS_KEY_ID'))
print(os.getenv('AWS_SECRET_ACCESS_KEY'))
print(os.getenv('AWS_REGION'))
print(os.getenv('S3_BUCKET_NAME'))

@app.on_event("startup")
async def startup_event():
    await create_tables()
    print("Database tables created/verified")

# Initialize S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-2')
)

S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')

# Pydantic models
class InitiateUploadRequest(BaseModel):
    filename: str
    size: int 
    contentType: str
    desiredKey: str
    userId: str

class InitiateUploadResponse(BaseModel):
    uploadId: str
    key: str
    urls: List[str]   
    partSize: int


class CompleteUploadRequest(BaseModel):
    uploadId: str
    key: str
    userId: str
    parts: List[Dict[str, Any]]

class PresignedUrlRequest(BaseModel):
    key: str
    contentType: str

class SignChunkReq(BaseModel):
    userId: str
    seq: int
    ext: str = "webm"  
    recordingId: str  
    contentType: str

class SignChunkResp(BaseModel):
    key: str
    url: str

class SignPartReq(BaseModel):
    key: str
    uploadId: str
    partNumber: int

class VideoMetadataResponse(BaseModel):
    id: str
    user_id: str
    s3_key: str
    filename: str
    content_type: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    file_size: Optional[int]
    title: Optional[str]
    description: Optional[str]
    is_public: bool


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def choose_part_size(file_size : int, default = 8 * 1024 * 1024) -> Tuple[int, int]:    
    """Choose the part size based on the file size"""

    MIN = 5 * 1024 * 1024
    part_size = max(default, MIN)

    if not file_size or file_size <= 0:
        total_parts = 1
        return part_size, total_parts

    # Increase part_size if we exceed 10,000 parts
    max_parts = 10_000
    if math.ceil(file_size / part_size) > max_parts:
        part_size = math.ceil(file_size / max_parts)

        # round up to at least MIN
        if part_size < MIN:
            part_size = MIN

    total_parts = math.ceil(file_size / part_size) if file_size else 1
    return part_size, total_parts

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI backend!"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "backend"}


@app.post("/api/upload/initiate", response_model=InitiateUploadResponse)
async def initiate_multipart_upload(request: InitiateUploadRequest, db: AsyncSession = Depends(get_db)):
    """Initiate a multipart upload to S3"""
    file_extension = os.path.splitext(request.filename)[1] or ".webm"
    unique_key = request.desiredKey or f"videos/{uuid.uuid4()}{file_extension}"
    
    part_size, _ = choose_part_size(request.size or 0)

    try:
        resp = s3_client.create_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=unique_key,
            ContentType=request.contentType,
        )
        upload_id = resp["UploadId"]

        video_record = VideoUpload(
            user_id=request.userId,
            s3_key=unique_key,
            filename=request.filename,
            content_type=request.contentType,
            upload_id=upload_id,
            status="uploading",
            file_size=request.size if request.size > 0 else None
        )
        
        db.add(video_record)
        await db.commit()
        await db.refresh(video_record)

        return InitiateUploadResponse(
            uploadId=upload_id,
            key=unique_key,
            urls=[],
            partSize=part_size,
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to initiate upload: {str(e)}")

@app.post("/api/upload/complete")
async def complete_multipart_upload(request: CompleteUploadRequest, db: AsyncSession = Depends(get_db)):
    """Complete the multipart upload"""
    print("here", request.key, request.uploadId, request.parts)
    parts_sorted = sorted(request.parts, key=lambda p: p["PartNumber"])

    try:
        response = s3_client.complete_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=request.key,
            UploadId=request.uploadId,
            MultipartUpload={"Parts": parts_sorted}
        )

        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key="/".join(request.key.split("/")[:-1]) + "/date.data",
            ContentType="application/json",
            Body=json.dumps({"finishedAt": datetime.utcnow().isoformat() + "Z"}),
        )

        # Update database record to completed
        stmt = select(VideoUpload).where(VideoUpload.upload_id == request.uploadId)
        result = await db.execute(stmt)
        video_record = result.scalar_one_or_none()
        
        if video_record:
            video_record.status = "completed"
            video_record.completed_at = datetime.utcnow()
            await db.commit()
            print(f"Updated video record {video_record.id} to completed status")
        else:
            print(f"Warning: No video record found for upload_id {request.uploadId}")

        print(request.key.split("/")[-1] + "date.data")
        return {
            "success": True,
            "location": response['Location'],
            "key": request.key
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to complete upload: {str(e)}")


@app.post("/api/upload/sign-chunk")
async def sign_chunk(request: SignChunkReq):
    key = f"users/{request.userId}/latest/parts/{request.recordingId}/part-{request.seq:06d}.{request.ext}"
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": key,
                "ContentType": request.contentType or f"video/{request.ext}",
            },
            ExpiresIn=600,
        )
        return {"success": True, "key": key, "url": url}
    except Exception as e:
        raise HTTPException(500, f"sign-chunk failed: {e}")


@app.post("/api/upload/sign-part")
async def sign_multipart_part(req: SignPartReq):
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="upload_part",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": req.key,
                "UploadId": req.uploadId,
                "PartNumber": req.partNumber,
            },
            ExpiresIn=3600,
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sign part URL: {str(e)}")
    


@app.delete("/api/upload/abort")
async def abort_multipart_upload(upload_id: str, key: str):
    """Abort a multipart upload"""
    try:
        s3_client.abort_multipart_upload(
            Bucket=S3_BUCKET_NAME,
            Key=key,
            UploadId=upload_id
        )
        
        return {"success": True, "message": "Upload aborted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to abort upload: {str(e)}")


@app.get("/api/videos", response_model=List[VideoMetadataResponse])
async def list_videos(user_id: Optional[str] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """List videos with optional filtering by user_id and status"""
    try:
        stmt = select(VideoUpload)
        
        if user_id:
            stmt = stmt.where(VideoUpload.user_id == user_id)
        if status:
            stmt = stmt.where(VideoUpload.status == status)
        
        stmt = stmt.order_by(VideoUpload.created_at.desc())
        
        result = await db.execute(stmt)
        videos = result.scalars().all()
        
        return [
            VideoMetadataResponse(
                id=video.id,
                user_id=video.user_id,
                s3_key=video.s3_key,
                filename=video.filename,
                content_type=video.content_type,
                status=video.status,
                created_at=video.created_at,
                completed_at=video.completed_at,
                file_size=video.file_size,
                title=video.title,
                description=video.description,
                is_public=video.is_public
            ) for video in videos
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list videos: {str(e)}")


@app.get("/api/videos/{video_id}", response_model=VideoMetadataResponse)
async def get_video(video_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific video by ID"""
    try:
        stmt = select(VideoUpload).where(VideoUpload.id == video_id)
        result = await db.execute(stmt)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return VideoMetadataResponse(
            id=video.id,
            user_id=video.user_id,
            s3_key=video.s3_key,
            filename=video.filename,
            content_type=video.content_type,
            status=video.status,
            created_at=video.created_at,
            completed_at=video.completed_at,
            file_size=video.file_size,
            title=video.title,
            description=video.description,
            is_public=video.is_public
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video: {str(e)}")


class UpdateVideoRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None


@app.patch("/api/videos/{video_id}")
async def update_video(video_id: str, request: UpdateVideoRequest, db: AsyncSession = Depends(get_db)):
    """Update video metadata"""
    try:
        stmt = select(VideoUpload).where(VideoUpload.id == video_id)
        result = await db.execute(stmt)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        if request.title is not None:
            video.title = request.title
        if request.description is not None:
            video.description = request.description
        if request.is_public is not None:
            video.is_public = request.is_public
        
        await db.commit()
        await db.refresh(video)
        
        return {"success": True, "message": "Video updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update video: {str(e)}")


@app.delete("/api/videos/{video_id}")
async def delete_video(video_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a video and its S3 objects"""
    try:
        stmt = select(VideoUpload).where(VideoUpload.id == video_id)
        result = await db.execute(stmt)
        video = result.scalar_one_or_none()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Delete from S3
        try:
            s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=video.s3_key)
            # Also try to delete the date.data file
            date_key = "/".join(video.s3_key.split("/")[:-1]) + "/date.data"
            s3_client.delete_object(Bucket=S3_BUCKET_NAME, Key=date_key)
        except Exception as s3_error:
            print(f"Warning: Failed to delete S3 objects: {s3_error}")
        
        # Delete from database
        await db.delete(video)
        await db.commit()
        
        return {"success": True, "message": "Video deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",            
        host="0.0.0.0",
        port=8000,
        reload=True,          
        reload_dirs=["."],   
        log_level="debug"   
    )

