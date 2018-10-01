attempt_counter=0
max_attempts=40

until $(curl --output /dev/null --silent --head --fail  http://localhost:800/api/v1/domains/waziup/sensors); do
    if [ ${attempt_counter} -eq ${max_attempts} ];then
      echo "Max attempts reached: platform didn't start correctly"
      exit 1
    fi

    printf '.'
    attempt_counter=$(($attempt_counter+1))
    sleep 5
done
