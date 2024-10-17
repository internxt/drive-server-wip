import path from 'path';

export const getPathFileData = (
  filePath: string,
): { folderPath: string; fileName: string; fileType: string } => {
  const folderPath = path.dirname(filePath);
  let fileExt = path.extname(filePath);
  const fileName = path.basename(filePath, fileExt);

  fileExt = fileExt.replace('.', '').trim();
  const fileType = fileExt.length > 0 ? fileExt : null;
  return { folderPath, fileName, fileType };
};

export const getPathDepth = (filePath: string): number => {
  if (filePath.startsWith('/')) {
    filePath = filePath.slice(1);
  }
  const parts = filePath.split('/');
  // If the path is empty after stripping, it means the depth is 0 (root folder)
  const depth = parts.length - 1;
  return depth;
};
