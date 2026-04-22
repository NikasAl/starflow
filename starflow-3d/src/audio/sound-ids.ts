// ============================================================
// Star Flow Command — Sound Effect Identifiers
// ============================================================

/** Sound effect IDs for short, non-looping game sounds */
export enum SFX {
  // UI
  UI_CLICK = 'ui_click',
  MENU_OPEN = 'menu_open',

  // Game actions
  PLANET_SELECT = 'planet_select',
  ROUTE_CREATE = 'route_create',
  ROUTE_DISCONNECT = 'route_disconnect',
  MISSILE_LAUNCH = 'missile_launch',

  // Combat
  MISSILE_HIT = 'missile_hit',
  EXPLOSION = 'explosion',
  PLANET_CAPTURE = 'planet_capture',

  // Ambient (short-looping environmental)
  GRAVITY_WELL = 'gravity_well',
  STAR_DANGER = 'star_danger',

  // Results
  VICTORY = 'victory',
  DEFEAT = 'defeat',
}

/** Music IDs for longer, looping background tracks */
export enum MUSIC {
  AMBIENT_SPACE = 'ambient_space',
  BATTLE_INTENSE = 'battle_intense',
  MENU_THEME = 'menu_theme',
}
