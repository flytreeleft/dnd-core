import invariant from 'invariant';
import isArray from 'lodash/isArray';
import matchesType from './utils/matchesType';
import HandlerRegistry from './HandlerRegistry';
import { getSourceClientOffset, getDifferenceFromInitialOffset } from './reducers/dragOffset';
import { areDirty } from './reducers/dirtyHandlerIds';

export default class DragDropMonitor {
  constructor(store) {
    this.store = store;
    this.registry = new HandlerRegistry(store);
    this.observeStateChange();
  }

  observeStateChange() {
    this.stateChangeListeners = [];

    let prevStateId = this.store.getState().stateId;
    this.store.subscribe(() => {
      const state = this.store.getState();
      const currentStateId = state.stateId;
      if (currentStateId === prevStateId) {
        return;
      }

      const listeners = [];
      this.stateChangeListeners.slice().forEach((listener) => {
        if (currentStateId === prevStateId + 1) {
          if (areDirty(state.dirtyHandlerIds, listener.handlerIds)) {
            listeners.push(listener.cb);
          }
        } else {
          listeners.push(listener.cb);
        }
      });

      try {
        listeners.forEach((listener) => {
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

    const stateChangeListener = {
      handlerIds,
      cb: listener,
    };
    this.stateChangeListeners.push(stateChangeListener);

    return () => {
      const index = this.stateChangeListeners.indexOf(stateChangeListener);
      if (index >= 0) {
        this.stateChangeListeners.splice(index, 1);
      }
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

  getClientOffset(untilToTopWin) {
    return untilToTopWin ?
      this.store.getState().dragOffset.clientOffsetUntilToTop :
      this.store.getState().dragOffset.clientOffset;
  }

  getPageOffset(untilToTopWin) {
    return untilToTopWin ?
      this.store.getState().dragOffset.pageOffsetUntilToTop :
      this.store.getState().dragOffset.pageOffset;
  }

  getSourceClientOffset() {
    return getSourceClientOffset(this.store.getState().dragOffset);
  }

  getDifferenceFromInitialOffset() {
    return getDifferenceFromInitialOffset(this.store.getState().dragOffset);
  }
}
