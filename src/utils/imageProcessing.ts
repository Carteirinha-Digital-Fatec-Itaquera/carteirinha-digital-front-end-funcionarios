const maxBytes = 200 * 1024;

export async function compressImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecione um arquivo JPG, PNG ou WebP.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a foto.');
    let scale = Math.min(1, 600 / bitmap.width, 800 / bitmap.height);
    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
      if (blob && blob.size <= maxBytes) return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
      scale *= 0.8;
    }
    throw new Error('Não foi possível reduzir a foto ao limite de 200 KB.');
  } finally {
    bitmap.close();
  }
}
