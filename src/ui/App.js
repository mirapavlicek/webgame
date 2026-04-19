import { Component } from './Component.js';
import { h, clear } from '../utils/dom.js';
import { TopBar } from './TopBar.js';
import { Sidebar } from './Sidebar.js';
import { NotificationFeed } from './NotificationFeed.js';
import { StatsPanel } from './panels/StatsPanel.js';
import { FinancePanel } from './panels/FinancePanel.js';
import { IncidentPanel } from './panels/IncidentPanel.js';
import { StaffPanel } from './panels/StaffPanel.js';
import { ViewportHUD } from './ViewportHUD.js';
import { resetCamera } from '../rendering/renderer.js';

export class App extends Component {
  constructor(root, state) {
    super(root);
    this.state = state;
  }

  mount() {
    super.mount(this.state);
    this.topBarEl = document.getElementById('topbar');
    this.sidebarEl = document.getElementById('sidebar');
    this.feedEl = document.getElementById('notif-feed');
    this.statsEl = document.getElementById('panel-stats-body');
    this.financeEl = document.getElementById('panel-finance-body');
    this.incidentsEl = document.getElementById('panel-incidents-body');
    this.staffEl = document.getElementById('panel-staff-body');

    this.topBar = new TopBar(this.topBarEl);
    this.sidebar = new Sidebar(this.sidebarEl);
    this.feed = new NotificationFeed(this.feedEl, this.state);
    this.stats = new StatsPanel(this.statsEl);
    this.finance = new FinancePanel(this.financeEl);
    this.incidents = new IncidentPanel(this.incidentsEl);
    this.staff = new StaffPanel(this.staffEl);
    this.viewportEl = document.querySelector('.viewport');
    this.viewportHUD = new ViewportHUD(this.viewportEl, this.state);

    this.topBar.mount(this.state);
    this.sidebar.mount(this.state);
    this.feed.mount(this.state);
    this.stats.mount(this.state);
    this.finance.mount(this.state);
    this.incidents.mount(this.state);
    this.staff.mount(this.state);
    this.viewportHUD.mount();

    // Panel collapsing
    for (const p of document.querySelectorAll('.panel')) {
      const head = p.querySelector('.panel-header');
      if (head) head.addEventListener('click', () => p.classList.toggle('collapsed'));
    }

    // Zoom controls
    document.getElementById('zoomIn')?.addEventListener('click', () => this.zoom(this.state, 1.25));
    document.getElementById('zoomOut')?.addEventListener('click', () => this.zoom(this.state, 0.8));
    document.getElementById('zoomReset')?.addEventListener('click', () => resetCamera(this.state));
  }

  zoom(state, factor) {
    const cam = state.ui.camera;
    const canvas = document.getElementById('mapCanvas');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const nz = Math.max(0.2, Math.min(5, cam.zoom * factor));
    cam.x = cx - (cx - cam.x) * (nz / cam.zoom);
    cam.y = cy - (cy - cam.y) * (nz / cam.zoom);
    cam.zoom = nz;
  }

  update(state) {
    this.topBar.update(state);
    this.stats.update(state);
    this.finance.update(state);
    this.incidents.update(state);
    this.staff.update(state);
    this.viewportHUD?.updateTooltip();
  }
}
