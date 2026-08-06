export type ManageAction = 'manage';

export type ReadAction = 'read';

export type CrudAction =
  | ManageAction
  | ReadAction
  | 'create'
  | 'update'
  | 'delete';
