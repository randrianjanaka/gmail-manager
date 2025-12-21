import os
import sys
import pytest

def run_tests():
    # Only run if RUN_TESTS env var is set to 'true'
    if os.getenv('RUN_TESTS', 'false').lower() == 'true':
        print("Running startup tests...")
        # Add src to python path for imports
        sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))
        
        exit_code = pytest.main(['-v', 'tests/'])
        if exit_code != 0:
            print("Tests failed! Exiting...")
            sys.exit(exit_code)
        print("Tests passed!")
    else:
        print("Skipping tests (RUN_TESTS not set to true)")

if __name__ == "__main__":
    run_tests()
