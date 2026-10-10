import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import export_glb, load_character

export_glb(load_character("delivery"))
