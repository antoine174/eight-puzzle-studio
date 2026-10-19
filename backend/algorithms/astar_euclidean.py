import math
import heapq
from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def euclidean_heuristic(state: Tuple[int, ...]) -> float:
   
    distance = 0.0
     
    return distance

def solve_astar_euclidean(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)

     

    return tracker.build_solution("A* (Euclidean)", goal_found=False)