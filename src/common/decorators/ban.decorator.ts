import { SetMetadata } from '@nestjs/common';

export const VISIBLE_BY_BAN = 'VisibleByBan';
export const VisibleByBan = () => SetMetadata(VISIBLE_BY_BAN, true);
