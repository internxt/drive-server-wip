import path from 'path';

export const getPathFileData = (
  filePath: string,
): { folderPath: string; fileName: string; fileType: string } => {
  const folderPath = path.dirname(filePath);
  const fileType = path.extname(filePath);
  const fileName = path.basename(filePath, fileType);
  return { folderPath, fileName, fileType: fileType.replace('.', '').trim() };
};
