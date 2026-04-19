// Base component: mount once, update cheaply.
// Not a framework — just a predictable place to hang lifecycle.

export class Component {
  constructor(root) {
    this.root = root;
    this._mounted = false;
  }
  mount(state) {
    if (this._mounted) return;
    this._mounted = true;
    this.render?.(state);
  }
  update(state) {
    if (!this._mounted) return;
    this.render?.(state);
  }
  unmount() {
    if (!this._mounted) return;
    this._mounted = false;
    this.root.replaceChildren();
  }
}
