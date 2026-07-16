import { SetMetadata } from '@nestjs/common';

export const IS_VISIBLE_BY_BAN_KEY = 'isVisibleByBan';
export const VisibleByBan = () => SetMetadata(IS_VISIBLE_BY_BAN_KEY, true);
