# S3 Multipart Upload Setup

## Prerequisites

1. AWS account with S3 access
2. S3 bucket created
3. AWS credentials with proper permissions

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Environment Variables
Create a `.env` file in the `backend` directory with:

```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

### 3. S3 Bucket CORS Configuration
Configure your S3 bucket with the following CORS policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4. IAM Permissions
Your AWS user/role needs these permissions:
- `s3:CreateMultipartUpload`
- `s3:UploadPart`
- `s3:CompleteMultipartUpload`
- `s3:AbortMultipartUpload`
- `s3:PutObject`

### 5. Start Backend
```bash
cd backend
python main.py
```

## Frontend Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Frontend
```bash
npm run dev
```

## Usage

1. Open http://localhost:3000
2. Select a video file using the file input
3. Click "Upload to S3"
4. Monitor the progress bar and status messages
5. Large videos will be uploaded in 5MB chunks for optimal performance

## Features

- ✅ Multipart upload for large files
- ✅ Progress tracking
- ✅ Error handling
- ✅ File type validation
- ✅ Chunked upload (5MB chunks)
- ✅ Presigned URLs for secure uploads
- ✅ Upload abort capability

## Troubleshooting

- Ensure your AWS credentials are valid
- Check S3 bucket CORS configuration
- Verify bucket permissions
- Check browser console for detailed error messages
