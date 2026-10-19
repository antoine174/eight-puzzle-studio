from collections import deque
from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def solve_bfs(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)
 

    return tracker.build_solution("BFS", goal_found=False)