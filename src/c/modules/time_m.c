#include <pebble.h>
#include "include/time_m.h"
#include "../settings.h"
#include "../utils/include/timeutils.h"
#include "../utils/include/textutils.h"

static Layer *s_this_layer;
static void prv_populate_time_layer(Layer *, GContext *);

void init_time_layer(GRect rect) {
  s_this_layer = layer_create(rect);
  layer_set_update_proc(s_this_layer, prv_populate_time_layer);
}

void deinit_time_layer() {
  if (s_this_layer) {
    layer_destroy(s_this_layer);
  }
}

void time_layer_update_time() {
  layer_mark_dirty(s_this_layer);
}


Layer* get_layer_time() {
  return s_this_layer;
}

static void prv_populate_time_layer(Layer *me, GContext *ctx) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Draw: TIME");
  GFont font = fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);
  GRect pretty_rect = get_pretty_rect_for_text(layer_get_bounds(me), font);
  graphics_draw_text(ctx, get_currect_time(CLOCK_FORMAT), \
      font, \
      pretty_rect, \
      GTextOverflowModeWordWrap, \
      GTextAlignmentCenter, \
      NULL);
}
