import time
from typing import Tuple, List, Dict, Optional
from models import StepSnapshot

GOAL_STATE: Tuple[int, ...] = (0, 1, 2, 3, 4, 5, 6, 7, 8)

def is_solvable(state: List[int]) -> Tuple[bool, int]:
    """
    check if the nversion is even to make sure it is solvable"""
    tiles = [x for x in state if x != 0]
    inversions = 0
    for i in range(len(tiles)):
        for j in range(i + 1, len(tiles)):
            if tiles[i] > tiles[j]:
                inversions += 1
    return (inversions % 2 == 0), inversions

def get_neighbors(state: Tuple[int, ...]) -> List[Tuple[str, Tuple[int, ...]]]:
    """
    return array of the next balid states direction , the state after going there
    """
    zero_idx = state.index(0)
    row, col = divmod(zero_idx, 3)
    neighbors = []
    moves = [
        ("Up",-1,0),
        ("Down",1,0),
        ("Left",0,-1),
        ("Right",0,1),
    ]

    for action, dr, dc in moves:
        new_r, new_c = row + dr, col + dc
        if 0 <= new_r < 3 and 0 <= new_c < 3:
            swap_idx = new_r * 3 + new_c
            new_state = list(state)
            new_state[zero_idx], new_state[swap_idx] = new_state[swap_idx], new_state[zero_idx]
            neighbors.append((action, tuple(new_state)))

    return neighbors

class TelemetryTracker:

    def __init__(self, initial_state: Tuple[int, ...]):
        self.initial_state = initial_state
        self.start_time = time.perf_counter()
        self.nodes_expanded = 0
        self.max_search_depth = 0
        self.parent_map: Dict[Tuple[int, ...], Tuple[Optional[Tuple[int, ...]], str, int]] = {
            initial_state: (None, "Initial", 0)
        }

    def record_expansion(self, current_state: Tuple[int, ...], current_depth: int):
        """ we call this to rincrement the nodes discovered"""
        self.nodes_expanded += 1
        if current_depth > self.max_search_depth:
            self.max_search_depth = current_depth

    def record_child(
        self,
        parent_state: Tuple[int, ...],
        child_state: Tuple[int, ...],
        action: str,
        child_depth: int
    ):
        self.parent_map[child_state] = (parent_state, action, child_depth)
        if child_depth > self.max_search_depth:
            self.max_search_depth = child_depth

    def build_solution(self, algorithm_name: str, goal_found: bool, final_depth: int = 0) -> dict:
        """when finding the solution call it to return everything"""
        elapsed_ms = round((time.perf_counter() - self.start_time) * 1000, 3)
        solvable, inv = is_solvable(list(self.initial_state))

        if not goal_found:
            return {
                "algorithm": algorithm_name,
                "solvable": solvable,
                "inversions": inv,
                "path_to_goal": [],
                "cost_of_path": 0,
                "nodes_expanded": self.nodes_expanded,
                "search_depth": 0,
                "max_search_depth": self.max_search_depth,
                "running_time_ms": elapsed_ms,
                "traceable_steps": [],
            }

        # Backtrack
        path_actions = []
        board_sequence = []
        curr = GOAL_STATE

        while curr is not None:
            parent, action, depth = self.parent_map[curr]
            board_sequence.append((action, list(curr)))
            if action != "Initial":
                path_actions.append(action)
            curr = parent

        path_actions.reverse()
        board_sequence.reverse()

        traceable_steps = [
            StepSnapshot(step_number=idx, action=act, board=brd)
            for idx, (act, brd) in enumerate(board_sequence)
        ]

        return {
            "algorithm": algorithm_name,
            "solvable": solvable,
            "inversions": inv,
            "path_to_goal": path_actions,
            "cost_of_path": len(path_actions),
            "nodes_expanded": self.nodes_expanded,
            "search_depth": len(path_actions),
            "max_search_depth": self.max_search_depth,
            "running_time_ms": elapsed_ms,
            "traceable_steps": traceable_steps,
        }