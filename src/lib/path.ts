import path from 'path';

export const getPathFileData = (
  filePath: string,
): { parentPath: string; fileName: string; fileType: string } => {
  const parentPath = path.dirname(filePath);
  const fileType = path.extname(filePath);
  const fileName = path.basename(filePath, fileType);
  return { parentPath, fileName, fileType: fileType.replace('.', '').trim() };
};
