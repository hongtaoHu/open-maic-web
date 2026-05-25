// SPDX-License-Identifier: AGPL-3.0
/**
 * Dexie IndexedDB skeleton for local stage/classroom persistence.
 */

import Dexie, { type Table } from 'dexie';

import type { Scene, Stage } from '@/types/stage';

export interface LocalClassroomRecord {
  id: string;
  stage: Stage;
  scenes: Scene[];
  updatedAt: number;
}

export class OpenMaicDatabase extends Dexie {
  classrooms!: Table<LocalClassroomRecord, string>;

  constructor() {
    super('openmaic-mvp');
    this.version(1).stores({
      classrooms: 'id, updatedAt',
    });
  }
}

export const db = new OpenMaicDatabase();
