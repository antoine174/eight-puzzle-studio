from collections import deque
from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_bfs(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)
 
    queue = deque([(initial_state, 0)])
    seen = {initial_state}
    while queue:
        state, depth = queue.popleft()

        if state == GOAL_STATE:
            return tracker.build_solution("BFS", goal_found=True, final_depth=depth)
            
        tracker.record_expansion(state, depth)

        for move, child in get_neighbors(state):
            if child not in seen:
                seen.add(child)                
                tracker.record_child(state, child, move, depth + 1)                
                queue.append((child, depth + 1))

    return tracker.build_solution("BFS", goal_found=False)