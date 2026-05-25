// SPDX-License-Identifier: AGPL-3.0
/**
 * Dexie IndexedDB skeleton for local stage/classroom persistence.
 */

import Dexie, { type Table } from 'dexie';

import type { SceneTtsSegmentRecord } from '@/types/sceneTts';
import type { Scene, Stage } from '@/types/stage';

export interface LocalClassroomRecord {
  id: string;
  stage: Stage;
  scenes: Scene[];
  updatedAt: number;
}

export class OpenMaicDatabase extends Dexie {
  classrooms!: Table<LocalClassroomRecord, string>;
  sceneTtsSegments!: Table<SceneTtsSegmentRecord, string>;

  constructor() {
    super('openmaic-mvp');
    this.version(1).stores({
      classrooms: 'id, updatedAt',
    });
    this.version(2).stores({
      classrooms: 'id, updatedAt',
      sceneTtsSegments:
        'id, classroomId, sceneId, [classroomId+sceneId], segmentIndex, sceneOrder',
    });
  }
}

export const db = new OpenMaicDatabase();
