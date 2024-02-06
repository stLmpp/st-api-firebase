import { Injectable } from '@nestjs/common';
import { getClazz } from '@st-api/core';
import { Eventarc } from 'firebase-admin/eventarc';

@Injectable()
export class FirebaseAdminEventarc extends getClazz<Eventarc>() {}
