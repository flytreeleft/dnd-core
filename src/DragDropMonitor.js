import invariant from 'invariant';
import isArray from 'lodash/isArray';
import uniq from 'lodash/uniq';
import matchesType from './utils/matchesType';
import HandlerRegistry from './HandlerRegistry';
import { getSourceClientOffset, getDifferenceFromInitialOffset } from './reducers/dragOffset';

export default class DragDropMonitor {
  constructor(store) {
    this.store = store;
    this.registry = new HandlerRegistry(store);
    this.observeStateChange();
  }

  observeStateChange() {
    this.stateChangeListenersMap = {};

    let prevStateId = this.store.getState().stateId;
    this.store.subscribe(() => {
      const state = this.store.getState();
      const currentStateId = state.stateId;
      if (currentStateId === prevStateId) {
        return;
      }

      const dirtyHandlerIds = state.dirtyHandlerIds;
      const listeners = dirtyHandlerIds.reduce((result, handleId) => {
        return result.concat(this.stateChangeListenersMap[handleId] || []);
      }, []);

      try {
        uniq(listeners).forEach((listener) => {
          listener();
        });
      } finally {
        prevStateId = currentStateId;
      }
    });
  }

  subscribeToStateChange(listener, options = {}) {
    const { handlerIds } = options;
    invariant(
      typeof listener === 'function',
      'listener must be a function.',
    );
    invariant(
      typeof handlerIds === 'undefined' || isArray(handlerIds),
      'handlerIds, when specified, must be an array of strings.',
    );

    if (!handlerIds) {
      let prevStateId = this.store.getState().stateId;
      const handleChange = () => {
        const state = this.store.getState();
        const currentStateId = state.stateId;
        if (currentStateId === prevStateId) {
          return;
        }

        try {
          listener();
        } finally {
          prevStateId = currentStateId;
        }
      };

      return this.store.subscribe(handleChange);
    }

    handlerIds.forEach((handlerId) => {
      let listeners = [].concat(this.stateChangeListenersMap[handlerId] || []);

      if (listeners.indexOf(listener) < 0) {
        listeners.push(listener);
        this.stateChangeListenersMap[handlerId] = listeners;
      }
    });

    return () => {
      handlerIds.forEach((handlerId) => {
        let listeners = [].concat(this.stateChangeListenersMap[handlerId] || []);
        let index = listeners.indexOf(listener);

        if (index >= 0) {
          listeners.splice(index, 1);
          this.stateChangeListenersMap[handlerId] = listeners;
        }
      });
    };
  }

  subscribeToOffsetChange(listener) {
    invariant(
      typeof listener === 'function',
      'listener must be a function.',
    );

    let previousState = this.store.getState().dragOffset;
    const handleChange = () => {
      const nextState = this.store.getState().dragOffset;
      if (nextState === previousState) {
        return;
      }

      previousState = nextState;
      listener();
    };

    return this.store.subscribe(handleChange);
  }

  canDragSource(sourceId) {
    const source = this.registry.getSource(sourceId);
    invariant(source, 'Expected to find a valid source.');

    if (this.isDragging()) {
      return false;
    }

    return source.canDrag(this, sourceId);
  }

  canDropOnTarget(targetId) {
    const target = this.registry.getTarget(targetId);
    invariant(target, 'Expected to find a valid target.');

    if (!this.isDragging() || this.didDrop()) {
      return false;
    }

    const targetType = this.registry.getTargetType(targetId);
    const draggedItemType = this.getItemType();
    return matchesType(targetType, draggedItemType) &&
           target.canDrop(this, targetId);
  }

  isDragging() {
    return Boolean(this.getItemType());
  }

  isDraggingSource(sourceId) {
    const source = this.registry.getSource(sourceId, true);
    invariant(source, 'Expected to find a valid source.');

    if (!this.isDragging() || !this.isSourcePublic()) {
      return false;
    }

    const sourceType = this.registry.getSourceType(sourceId);
    const draggedItemType = this.getItemType();
    if (sourceType !== draggedItemType) {
      return false;
    }

    return source.isDragging(this, sourceId);
  }

  isOverTarget(targetId, options = { shallow: false }) {
    const { shallow } = options;
    if (!this.isDragging()) {
      return false;
    }

    const targetType = this.registry.getTargetType(targetId);
    const draggedItemType = this.getItemType();
    if (!matchesType(targetType, draggedItemType)) {
      return false;
    }

    const targetIds = this.getTargetIds();
    if (!targetIds.length) {
      return false;
    }

    const index = targetIds.indexOf(targetId);
    if (shallow) {
      return index === targetIds.length - 1;
    } else {
      return index > -1;
    }
  }

  getItemType() {
    return this.store.getState().dragOperation.itemType;
  }

  getItem() {
    return this.store.getState().dragOperation.item;
  }

  getSourceId() {
    return this.store.getState().dragOperation.sourceId;
  }

  getTargetIds() {
    return this.store.getState().dragOperation.targetIds;
  }

  getDropResult() {
    return this.store.getState().dragOperation.dropResult;
  }

  didDrop() {
    return this.store.getState().dragOperation.didDrop;
  }

  isSourcePublic() {
    return this.store.getState().dragOperation.isSourcePublic;
  }

  getInitialClientOffset() {
    return this.store.getState().dragOffset.initialClientOffset;
  }

  getInitialSourceClientOffset() {
    return this.store.getState().dragOffset.initialSourceClientOffset;
  }

  getClientOffset() {
    return this.store.getState().dragOffset.clientOffset;
  }

  getSourceClientOffset() {
    return getSourceClientOffset(this.store.getState().dragOffset);
  }

  getDifferenceFromInitialOffset() {
    return getDifferenceFromInitialOffset(this.store.getState().dragOffset);
  }
}
