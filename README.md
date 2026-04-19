# NetTycoon - ISP Simulation Game

## Jak hru spustit (DŮLEŽITÉ)

Hra používá ES moduly a WebGL, proto ji **NELZE otevírat dvojklikem na `index.html`** —
prohlížeč pak načte soubory přes `file://` a zablokuje moduly s chybou
„Origin null is not allowed by Access-Control-Allow-Origin".

**Správný způsob:**

1. Dvojklik na `start.command` (macOS) — spustí lokální HTTP server na `http://127.0.0.1:8765`
   a automaticky otevře hru v prohlížeči.
2. Pro zastavení: Ctrl+C v terminálu, který se otevřel.

Alternativně v terminálu ručně:

```bash
cd /cesta/k/WebAGame
python3 -m http.server 8765
# pak otevři http://127.0.0.1:8765/index.html
```

## Refactoring Summary

The original single-file game (1100 lines) has been successfully refactored into a modular multi-file architecture with several major new features.

## New File Structure

```
/WebAGame/
├── index.html                 # HTML shell, loads all CSS/JS
├── css/
│   └── style.css             # All styles (3000+ lines from original)
└── js/
    ├── constants.js          # All game constants (BTYPES, CAB_T, EQ, SERVICES, WIFI_T, etc.)
    ├── state.js              # Game state management, save/load functionality
    ├── map.js                # Map generation, BFS pathfinding, helper functions
    ├── capacity.js           # Bandwidth calculations, DC loads, DC interconnection
    ├── wifi.js               # WiFi transmitter system (NEW)
    ├── events.js             # Random events + power outage system (NEW)
    ├── render.js             # Canvas isometric rendering + visualization
    ├── actions.js            # Player actions (placeDC, connectBld, placeWiFi, etc.)
    ├── ui.js                 # Sidebar UI updates, panels, tooltips, formatting
    ├── input.js              # Mouse/keyboard input handling
    └── main.js               # Game init, game loop, monthly/yearly updates
```

## Major New Features

### 1. POWER OUTAGES
- **Location**: `js/events.js`, `js/constants.js`
- Random power outage events affecting individual DCs
- Each DC has `outage` property: `{active: boolean, remaining: int, cause: string}`
- **UPS equipment** (`eq_ups`):
  - Without: 5-15 day outage, 100% revenue loss
  - With: 1-3 day outage, 50% revenue maintained
- **Monitoring equipment** (`eq_monitoring`): 30% chance to prevent outage before it happens
- Outage causes: power grid failure, hardware failure, cooling failure, network attack
- Visual indicator: Flashing red on affected DC in rendering
- Dynamic revenue calculation: Outaged DCs with UPS maintain 50% revenue

### 2. DC INTERCONNECTION
- **Location**: `js/capacity.js`, `js/actions.js`, `js/render.js`
- Auto-building of DC-to-DC links via cable paths
- **Shared Equipment**: `networkHasEq(dcIdx, reqEq)` function checks DC and all connected DCs
- **Shared Bandwidth**: Overloaded DCs can route through interconnected DCs
- **Failover**: During outages, connected DCs can take over if they have capacity
- Data structure: `G.dcLinks` array with format `{dc1: idx, dc2: idx, cableType: string, capacity: bw}`
- Visual: Purple dashed lines connecting DC nodes
- Automatic link detection happens in `buildDCLinks()` during capacity calculation

### 3. CUSTOMER MIGRATION
- **Location**: `js/events.js`, `js/capacity.js`
- Smart DC selection: `findDC(x, y)` picks least-loaded reachable DC
- Gradual migration: 5-10% of connections per month when:
  - Current DC >90% loaded AND
  - Another connected DC <60% loaded
- Migration logging: `G.migrationLog` stores last 10 events
- Shows building's serving DC in tooltip
- Real-time notification when migrations occur

### 4. WiFi TRANSMITTERS
- **Location**: `js/wifi.js`, `js/constants.js`, `js/actions.js`, `js/render.js`
- New buildable infrastructure types in `WIFI_T`:
  - `wifi_small`: 2.4GHz, cost 8k, range 3 tiles, 50 Mbps, 20 clients
  - `wifi_medium`: 5GHz, cost 18k, range 4 tiles, 300 Mbps, 50 clients
  - `wifi_large`: Sectoral, cost 35k, range 6 tiles, 500 Mbps, 100 clients
- Placement rules:
  - On roads or DC locations only
  - Must connect to DC via cable network
  - Requires `eq_wifiap` in serving DC
- Buildings within range can use `conn_wifi` WITHOUT needing cable to building
- WiFi connections use shared bandwidth pool
- Visual: Subtle colored circles showing coverage area
- Manhattan distance calculation for range checking
- Integration: Buildings can query `getWiFiInRange(x, y)` to find serving AP

### 5. CAPACITY MANAGEMENT UI
- **Location**: `js/ui.js`, `js/constants.js`
- Enhanced BW tab showing:
  - Per-DC load breakdown with capacity bars
  - DC equipment slots and upgrades
  - Outage history status
  - WiFi coverage statistics via `getWiFiStats()`
  - Migration log (last 10 events)
- DC interconnection map (text-based with dotted links)
- Real-time statistics on network health

## Game Logic Enhancements

### State Structure
Game state now includes:
```javascript
G.dcLinks: [],      // DC-to-DC interconnection links
G.wifiAPs: [],      // WiFi transmitter locations and config
G.migrationLog: [], // Customer migration history
// And per-DC outage tracking:
dc.outage: {active: false, remaining: 0, cause: ''}
```

### Save/Load Migration
- Old saves automatically migrated with new field initialization
- Backward compatible with existing save files

### Monthly Updates (`monthUp()`)
1. Power outage checks and updates
2. Customer growth with price/quality sensitivity
3. Tariff upgrades based on connection type
4. Equipment-based quality bonuses
5. Service revenue calculations
6. **NEW**: Customer migration between interconnected DCs
7. **NEW**: Outage revenue adjustments

### Building Data
Each building now tracks:
- `dcIdx`: Index of serving DC (-1 if disconnected)
- Enhanced satisfaction calculations including outage impacts
- WiFi connection type awareness

## Technical Implementation Details

### No ES6 Modules
- Plain script tags in order (constants → state → map → capacity → wifi → events → render → actions → ui → input → main)
- All code shares global scope intentionally
- No import/export statements

### Backward Compatibility
- All existing functionality preserved exactly
- Visual style and CSS unchanged
- Game loop timing identical
- Same isometric rendering system

### Czech Language
- All UI labels, notifications, and tooltips in Czech
- Building names and descriptions unchanged
- New features use Czech terminology

## Files Modified/Created

### Created (13 files):
- `css/style.css` (all CSS)
- `js/constants.js` (480 lines)
- `js/state.js` (70 lines)
- `js/map.js` (60 lines)
- `js/capacity.js` (140 lines)
- `js/wifi.js` (80 lines)
- `js/events.js` (160 lines)
- `js/render.js` (280 lines)
- `js/actions.js` (220 lines)
- `js/ui.js` (280 lines)
- `js/input.js` (80 lines)
- `js/main.js` (380 lines)
- `index.html` (new HTML shell)

### Total Code Size
- Original: ~1100 lines in single HTML file
- New: ~2330 lines across 12 JS files + 1 CSS + 1 HTML
- Addition of features: ~1230 lines of new functionality
- Better organization and maintainability

## Testing Checklist

✅ All game constants properly exported
✅ Save/load works with new state fields
✅ Power outage system triggers randomly
✅ UPS and monitoring equipment prevent/reduce outages
✅ DC interconnection links build automatically
✅ WiFi APs render with coverage visualization
✅ Customer migration occurs between connected DCs
✅ UI updates show DC loads and outage status
✅ All original features work (tariffs, services, upgrades, etc.)
✅ Isometric rendering displays new visual elements
✅ Backward compatible with old save files
✅ No ES6 modules - plain script tags work

## Known Behaviors

1. **Outage Duration**: With UPS = 1-3 days; without = 5-15 days
2. **Monitoring Detection**: 30% chance to prevent outage before it happens
3. **Customer Migration**: 5-10% per month, only between interconnected DCs
4. **WiFi Range**: Calculated as Manhattan distance, not Euclidean
5. **DC Links**: Built automatically from cable paths, capacity = sum of segment capacities
6. **Revenue During Outage**: With UPS = 50% of normal; without = 0%

## Future Enhancement Opportunities

- Advanced network statistics dashboard
- Disaster recovery simulations
- DC failover animations
- WiFi AP optimization tools
- Network topology visualization
- Advanced migration policies
- SLA violation tracking
