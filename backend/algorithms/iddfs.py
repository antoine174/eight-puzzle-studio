from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_iddfs(initial_state: Tuple[int, ...], max_depth_limit: int = 35) -> dict:
    tracker = TelemetryTracker(initial_state)
  #loop on all depth till we reach the limit
    for limit in range(max_depth_limit + 1):
        stack = [(initial_state, 0)]
        seen = {initial_state: 0}
        tracker.parent_map[initial_state] = (None, "Initial", 0)
        #while stack not empty
        while stack:
            state, depth = stack.pop()
            if state == GOAL_STATE:
                return tracker.build_solution("Iterative DFS", goal_found=True, final_depth=depth)
            tracker.record_expansion(state, depth, prefix=f"L{limit}")

            if depth < limit:
                for move, child in reversed(get_neighbors(state)):
                    next_depth = depth + 1
                    if child not in seen or next_depth < seen[child]:
                        seen[child] = next_depth
                        tracker.record_child(state, child, move, next_depth)
                        stack.append((child, next_depth))

    return tracker.build_solution("Iterative DFS", goal_found=False)