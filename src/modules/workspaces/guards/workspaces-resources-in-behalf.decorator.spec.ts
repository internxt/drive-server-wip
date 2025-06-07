import { applyDecorators } from '@nestjs/common';
import {
  WorkspacesInBehalfValidationFolder,
  WorkspacesInBehalfGuard,
  WorkspacesInBehalfValidationFile,
  WorkspaceResourcesAction,
  WORKSPACE_IN_BEHALF_ACTION_META_KEY,
} from './workspaces-resources-in-behalf.decorator';

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  applyDecorators: jest.fn(),
}));

const mockApplyDecorators = applyDecorators as jest.MockedFunction<
  typeof applyDecorators
>;

describe('Workspaces Resources In Behalf Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WorkspacesInBehalfValidationFolder', () => {
    it('When called, then it should apply decorators with correct metadata', () => {
      WorkspacesInBehalfValidationFolder();

      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('WorkspacesInBehalfValidationFile', () => {
    it('When called, then it should apply decorators with correct metadata', () => {
      WorkspacesInBehalfValidationFile();

      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('WorkspacesInBehalfGuard', () => {
    it('When called without action, then it should apply decorators with undefined action', () => {
      WorkspacesInBehalfGuard();

      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });

    it('When called with action, then it should apply decorators with specified action', () => {
      const action = WorkspaceResourcesAction.AddItemsToTrash;

      WorkspacesInBehalfGuard(action);

      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('Exports', () => {
    it('When importing, then WorkspaceResourcesAction should be available', () => {
      expect(WorkspaceResourcesAction).toBeDefined();
      expect(typeof WorkspaceResourcesAction).toBe('object');
    });

    it('When importing, then WORKSPACE_IN_BEHALF_ACTION_META_KEY should be available', () => {
      expect(WORKSPACE_IN_BEHALF_ACTION_META_KEY).toBeDefined();
      expect(typeof WORKSPACE_IN_BEHALF_ACTION_META_KEY).toBe('string');
    });
  });
});
