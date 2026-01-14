FROM public.ecr.aws/lambda/python:3.11

# Copy requirements first (better caching)
COPY requirements.txt .

# Upgrade pip and install deps
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy solver code
COPY solver_cli.py ${LAMBDA_TASK_ROOT}/solver_cli.py
COPY app.py ${LAMBDA_TASK_ROOT}/app.py

# Lambda handler
CMD ["app.handler"]
