import { getPathFileData } from './path';

describe('Path class', () => {
  describe('getPathFileData', () => {
    it('When getPathFileData is called with a file with extension, then it returns its current data', () => {
      const testPath = '/folder1/folder2/file.test';
      const path = getPathFileData(testPath);
      expect(path.fileName).toBe('file');
      expect(path.fileType).toBe('test');
      expect(path.folderPath).toBe('/folder1/folder2');
    });

    it('When getPathFileData is called with a file without extension, then it returns its current data', () => {
      const testPath = '/rootfilewithoutextension';
      const path = getPathFileData(testPath);
      expect(path.fileName).toBe('rootfilewithoutextension');
      expect(path.fileType).toBe('');
      expect(path.folderPath).toBe('/');
    });
  });
});
