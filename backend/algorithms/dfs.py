from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_dfs(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)

    stack = [(initial_state, 0)]
    visited = set([initial_state])
    while stack:
        state, depth = stack.pop()
        if state == GOAL_STATE:
            return tracker.build_solution("DFS", goal_found=True, final_depth=depth)

        tracker.record_expansion(state, depth)

        for move, child in reversed(get_neighbors(state)):
            if child not in visited:
                visited.add(child)
                tracker.record_child(state, child, move, depth + 1)
                stack.append((child, depth + 1))

    return tracker.build_solution("DFS", goal_found=False)