# Traefic Reverse Proxy Docker Swarm

Instructions followed from [Docker Swarm Rocks!](https://dockerswarm.rocks/traefik/)

## Deployment Instructions
1. Specify the following ```ENV``` vars in ```.env```

```USERNAME```
```PASSWORD```
```HASHED_PASSWORD```

```DOMAIN```
```EMAIL```

2. Run ```export $(cat .env) > /dev/null 2>&1```
3. docker stack deploy -c docker-compose.yml traefik
