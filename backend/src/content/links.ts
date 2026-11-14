// Which events grow out of which. The team's CSVs list the events but not the order, so this
// is the cascade: an event listed here can only appear after ANY of its parents has happened.
// Events that are not listed are openers (they can happen first), and temptations are handled
// separately (they appear once the work is under way).
//
// Keep ids in sync with events/*.csv. A test fails if an id here does not exist.

export const LINKS: Record<string, Record<string, string[]>> = {
  'wall-removal': {
    footing_too_weak: ['wall_is_load_bearing'],
    beam_wont_fit: ['wall_is_load_bearing'],
    panel_is_full: ['wires_in_wall'],
    vent_hits_joist: ['vent_stack_found'],
    abatement_crew_booked: ['asbestos_found'],
    floor_gap_appears: ['floors_clash'],
    flooring_discontinued: ['floors_clash', 'floor_gap_appears'],
    ceiling_gap_appears: ['ceiling_texture_clashes'],
    popcorn_tests_positive: ['ceiling_texture_clashes', 'ceiling_gap_appears'],
  },
  'kitchen-faucet': {
    main_valve_fails: ['shutoff_seizes'],
    pipe_stub_short: ['shutoff_seizes'],
    utility_delayed: ['main_valve_fails'],
    blade_nicks_sink: ['nuts_seize'],
    fittings_dont_fit: ['supply_line_cracks'],
    sink_doesnt_fit: ['holes_dont_match'],
    countertop_chips: ['sink_doesnt_fit', 'holes_dont_match'],
    mold_under_cabinet: ['cabinet_floor_rots'],
  },
  'carpet-replacement': {
    joist_cracks: ['subfloor_goes_soft'],
    subfloor_hump: ['subfloor_goes_soft'],
    pipe_blocks_sister: ['joist_cracks'],
    screw_hits_pipe: ['floor_squeaks'],
    odor_returns: ['stains_appear'],
    black_mastic_appears: ['old_tile_found'],
    door_turns_hollow: ['doors_drag'],
    paint_line_shows: ['baseboards_crack'],
  },
  'window-caulking': {
    sheathing_is_rotten: ['trim_is_rotten'],
    flashing_missing: ['sheathing_is_rotten'],
    trim_profile_mismatch: ['trim_is_rotten'],
    stud_rot_spreads: ['sheathing_is_rotten'],
    window_size_odd: ['frame_rots'],
    stool_cracks: ['sill_cracks'],
    window_sticks: ['draft_found'],
    chips_in_garden: ['lead_paint_found'],
  },
  // The plan's chain: smoke, then the dust behind it, then the wall next to it, then the beehive.
  'dryer-replacement': {
    scorched_wall: ['dryer_smokes'],
    outlet_melted: ['dryer_smokes'],
    lint_everywhere: ['dryer_smokes'],
    vent_hose_crushed: ['dryer_smokes'],
    cat_in_vent: ['vent_hose_crushed', 'lint_everywhere'],
    wall_needs_opening: ['lint_everywhere', 'vent_hose_crushed'],
    beehive_found: ['wall_needs_opening'],
    honey_in_wall: ['beehive_found'],
    drywall_dust: ['wall_needs_opening'],
    plug_mismatch: ['outlet_melted'],
    dryer_wont_fit: ['dryer_smokes'],
    floor_dented: ['dryer_wont_fit'],
    vent_cap_clogged: ['vent_hose_crushed'],
  },
};
