import * as service from './path';

describe('Path class', () => {
  describe('getPathFileData', () => {
    it('When getPathFileData is called with a file with extension, then it returns its current data', () => {
      const testPath = '/folder1/folder2/file.test';
      const path = service.getPathFileData(testPath);
      expect(path.fileName).toBe('file');
      expect(path.fileType).toBe('test');
      expect(path.folderPath).toBe('/folder1/folder2');
    });

    it('When getPathFileData is called with a file with extension, then it returns its current data', () => {
      const testPath = '/rootfilewithextension.test';
      const path = service.getPathFileData(testPath);
      expect(path.fileName).toBe('rootfilewithextension');
      expect(path.fileType).toBe('test');
      expect(path.folderPath).toBe('/');
    });

    it('When getPathFileData is called with a file without extension, then it returns its current data', () => {
      const testPath = '/rootfilewithoutextension';
      const path = service.getPathFileData(testPath);
      expect(path.fileName).toBe('rootfilewithoutextension');
      expect(path.fileType).toBeNull();
      expect(path.folderPath).toBe('/');
    });

    it('When getPathFileData is called with a file without extension, then it returns its current data', () => {
      const testPath = '/folder1/folder2/file';
      const path = service.getPathFileData(testPath);
      expect(path.fileName).toBe('file');
      expect(path.fileType).toBeNull();
      expect(path.folderPath).toBe('/folder1/folder2');
    });
  });

  describe('getPathDepth', () => {
    it('When get depth from path is requested, then it is returned', async () => {
      expect(service.getPathDepth('/folder')).toStrictEqual(0);
      expect(service.getPathDepth('folder')).toStrictEqual(0);
      expect(service.getPathDepth('/')).toStrictEqual(0);
      expect(service.getPathDepth('/file.png')).toStrictEqual(0);
      expect(service.getPathDepth('/subfolder/file.png')).toStrictEqual(1);
      expect(service.getPathDepth('subfolder/file.png')).toStrictEqual(1);
      expect(
        service.getPathDepth('/subfolder/other/test/file.png'),
      ).toStrictEqual(3);

      const longPath =
        '/' + Array.from({ length: 22 }, (_, i) => `folder${i}`).join('/');
      expect(service.getPathDepth(longPath)).toStrictEqual(21);
    });
  });
});
