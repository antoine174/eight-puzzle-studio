import heapq
from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def manhattan_heuristic(state: Tuple[int, ...]) -> float:
   
    distance = 0
    
    return distance

def solve_astar_manhattan(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)
 

    return tracker.build_solution("A* (Manhattan)", goal_found=False)