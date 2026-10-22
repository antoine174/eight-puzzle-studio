import heapq
from typing import Tuple
from utils import GOAL_STATE, get_neighbors, TelemetryTracker

def manhattan_heuristic(state: Tuple[int, ...]) -> float:
    distance = 0.0
    for i, val in enumerate(state):
        if val != 0:
            curr_row, curr_col = divmod(i, 3)
            goal_row, goal_col = divmod(val, 3)            
            distance += abs(curr_row - goal_row) + abs(curr_col - goal_col)
            
    return distance

def solve_astar_manhattan(initial_state: Tuple[int, ...]) -> dict:
    tracker = TelemetryTracker(initial_state)
    
    pq = [(manhattan_heuristic(initial_state), initial_state, 0)]
    g_costs = {initial_state: 0}

    while pq:
        f_cost, state, depth = heapq.heappop(pq)

        if state == GOAL_STATE:
            return tracker.build_solution("A* (Manhattan)", goal_found=True, final_depth=depth)

        tracker.record_expansion(state, depth)

        for move, child in get_neighbors(state):
            new_depth = depth + 1
            if child not in g_costs or new_depth < g_costs[child]:
                g_costs[child] = new_depth
                tracker.record_child(state, child, move, new_depth)
                f_score = new_depth + manhattan_heuristic(child)
                heapq.heappush(pq, (f_score, child, new_depth))

    return tracker.build_solution("A* (Manhattan)", goal_found=False)