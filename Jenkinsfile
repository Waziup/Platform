pipeline {
    agent any
    environment {
        API_URL  = 'http://localhost:800/api/v2'
        MQTT_URL = 'tcp://localhost:3883'
    }
    stages {
        stage('Build') {
            steps {
                sh 'git submodule update --init --recursive'
                sh 'docker-compose build'
            }
        }
        stage('Run') {
            steps {
                sh 'docker-compose up -d'
            }
        }
        stage('Test') {
            steps {
                sh 'cd tests'
                sh 'npm test'
            }
        }
    }
    post {
        success {
            echo 'Success!'
        }
        failure {
            echo 'Failure!'
        }
        unstable {
            echo 'This will run only if the run was marked as unstable'
        }
        changed {
            echo 'This will run only if the state of the Pipeline has changed'
            echo 'For example, if the Pipeline was previously failing but is now successful'
        }
    }
}
