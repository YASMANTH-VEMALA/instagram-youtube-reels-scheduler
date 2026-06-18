import { NextRequest, NextResponse } from 'next/server';
import { uploadWatermark } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Read the file as an ArrayBuffer and convert to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Processing file upload: ${file.name}, type: ${file.type}`);

    // Upload to Supabase Storage
    const publicUrl = await uploadWatermark(buffer, file.name, file.type);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error('File upload failed:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error.message || error}` },
      { status: 500 }
    );
  }
}
