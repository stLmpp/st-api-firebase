import { Injectable } from '@nestjs/common';
import { Eventarc } from 'firebase-admin/eventarc';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseAdminEventarc extends getClazz<Eventarc>() {}
