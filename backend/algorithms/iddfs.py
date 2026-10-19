from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_iddfs(initial_state: Tuple[int, ...], max_depth_limit: int = 35) -> dict:
    tracker = TelemetryTracker(initial_state)

    # 1. increment the length evey time
    for limit in range(max_depth_limit + 1):
        stack = [(initial_state, 0)]
        visted = {initial_state: 0}  

        while stack:
            state, depth = stack.pop()
            if state == GOAL_STATE:
                return tracker.build_solution("Iterative DFS", goal_found=True, final_depth=depth)
            tracker.record_expansion(state, depth)

            if depth < limit:
                for move, child in reversed(get_neighbors(state)):
                    next_depth = depth + 1
                    #add condtion that even if it is visited bit 
                    if child not in visted or next_depth < visted[child]:
                        visted[child] = next_depth
                        tracker.record_child(state, child, move, next_depth)
                        stack.append((child, next_depth))

    return tracker.build_solution("Iterative DFS", goal_found=False)