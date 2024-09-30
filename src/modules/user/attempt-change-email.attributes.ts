export enum AttemptChangeEmailStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
}

export interface AttemptChangeEmailAttributes {
  id: number;
  userUuid: string;
  newEmail: string;
  status: AttemptChangeEmailStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
