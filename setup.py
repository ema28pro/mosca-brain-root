from setuptools import setup, find_packages

setup(
    name="moscabrain",
    version="1.0.0",
    description="Framework biofísico y simulador del conectoma del cerebro de la mosca (FlyWire Drosophila)",
    author="MoscaBrain Team",
    packages=find_packages(),
    install_requires=[
        "numpy",
        "scipy",
        "fastapi",
        "uvicorn",
        "websockets",
    ],
    python_requires=">=3.8",
)
