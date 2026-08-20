import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp!: App;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const bucketName = this.configService.get<string>('gcpStorage.bucketName');
    const projectId = this.configService.get<string>('gcpStorage.projectId');
    const keyFile = this.configService.get<string>('gcpStorage.keyFile');

    if (!bucketName || !projectId) {
      throw new Error('Missing gcpStorage.bucketName or gcpStorage.projectId — check environment configuration.');
    }
    if (process.env.NODE_ENV === 'production' && this.isEmulator) {
      throw new Error('FIREBASE_STORAGE_EMULATOR_HOST is set in production — refusing to start.');
    }

    this.firebaseApp = initializeApp({
      ...(this.isEmulator ? {} : { credential: keyFile ? cert(keyFile) : applicationDefault() }),
      projectId,
      storageBucket: bucketName,
    });
  }

  getStorageBucket() {
    return getStorage(this.firebaseApp).bucket();
  }

  get isEmulator(): boolean {
    return !!this.configService.get<string>('gcpStorage.emulatorHost');
  }

  get emulatorHost(): string {
    return this.configService.get<string>('gcpStorage.emulatorHost') ?? '';
  }
}