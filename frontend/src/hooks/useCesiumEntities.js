/**
 * useCesiumEntities – manages Cesium entity lifecycle (add / update / remove)
 */

import { useRef, useCallback } from 'react';
import * as Cesium from 'cesium';

export function useCesiumEntities(viewer) {
  const entityMapRef = useRef(new Map());

  const upsertEntity = useCallback((id, properties) => {
    if (!viewer) return;
    const existing = entityMapRef.current.get(id);
    if (existing) {
      // Update position
      if (properties.position) {
        existing.position = properties.position;
      }
      if (properties.billboard) {
        Object.assign(existing.billboard, properties.billboard);
      }
      if (properties.label) {
        Object.assign(existing.label, properties.label);
      }
    } else {
      const entity = viewer.entities.add({ id, ...properties });
      entityMapRef.current.set(id, entity);
    }
  }, [viewer]);

  const removeEntity = useCallback((id) => {
    if (!viewer) return;
    const entity = entityMapRef.current.get(id);
    if (entity) {
      viewer.entities.remove(entity);
      entityMapRef.current.delete(id);
    }
  }, [viewer]);

  const clearAll = useCallback(() => {
    if (!viewer) return;
    for (const [id, entity] of entityMapRef.current) {
      viewer.entities.remove(entity);
    }
    entityMapRef.current.clear();
  }, [viewer]);

  const getEntity = useCallback((id) => entityMapRef.current.get(id), []);

  return { upsertEntity, removeEntity, clearAll, getEntity, entityMap: entityMapRef };
}
