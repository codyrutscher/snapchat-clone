export const CLOUDINARY_CONFIG = {
  cloudName: 'duclkixrz', // Replace with your Cloudinary cloud name
  uploadPreset: 'Grammarly-clone', // Replace with your upload preset
  apiKey: '433151174381357', // Replace with your API key
  apiSecret: 'GosyVWCNH5o13CuouBv-3TPryWc', // Only use server-side
};

export const uploadToCloudinary = async (uri, type = 'image') => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: uri,
    type: type === 'image' ? 'image/jpeg' : 'video/mp4',
    name: `upload.${type === 'image' ? 'jpg' : 'mp4'}`
  });
  
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${type}/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};