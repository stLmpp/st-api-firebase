import { Injectable } from '@nestjs/common';
import { Auth } from 'firebase/auth';

import { getClazz } from '../common/get-clazz.js';

@Injectable()
export class FirebaseAuth extends getClazz<Auth>() {}
