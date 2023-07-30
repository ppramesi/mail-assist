# Using official python runtime base image
FROM python:3.9

# Setting the working directory in the container
WORKDIR /analyzer

# Copying requirements.txt
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copying the rest of your application's code
COPY . .

# Define the command to run your app using CMD which defines your runtime
CMD ["python3", "./analysis_service.py"]
