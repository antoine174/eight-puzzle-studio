from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_dfs(initial_state: Tuple[int, ...]) -> dict:
    #we dont want to track the dfs expansion as it can get very big
    tracker = TelemetryTracker(initial_state, track_expansions=False)
    stack = [(initial_state, 0)]
    seen = {initial_state}
    while stack:
        state, depth = stack.pop()

        if state == GOAL_STATE:
            return tracker.build_solution("DFS", goal_found=True, final_depth=depth)
        tracker.record_expansion(state, depth)

        for move, child in reversed(get_neighbors(state)):
            if child not in seen:
                seen.add(child)
                tracker.record_child(state, child, move, depth + 1)
                stack.append((child, depth + 1))

    return tracker.build_solution("DFS", goal_found=False)