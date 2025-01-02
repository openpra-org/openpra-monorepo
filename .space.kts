job("Monorepo Deployment") {

   val registry = "packages-space.openpra.org/p/openpra/containers/"
   val image = "openpra-monorepo"
   val remote = "$registry$image"

   host("Deployment Tags") {
     // use kotlinScript blocks for usage of parameters
     kotlinScript("Generate slugs") { api ->

       api.parameters["commitRef"] = api.gitRevision()
       api.parameters["gitBranch"] = api.gitBranch()

       val branchName = api.gitBranch()
         .removePrefix("refs/heads/")
         .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
         .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
         .lowercase() // Convert to lower case for consistency

       val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

       var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

       if (branchName == "main") {
         branchSlug = "v2"
         api.parameters["buildType"] = "production"
         api.parameters["debugMode"] = "false"
         api.parameters["isReview"] = "false"
         api.parameters["numWorkers"] = "32"
       } else {
         branchSlug = "review-$branchSlug"
         api.parameters["buildType"] = "development"
         api.parameters["debugMode"] = "true"
         api.parameters["isReview"] = "true"
         api.parameters["numWorkers"] = "2"
       }

       api.parameters["branchSlug"] = branchSlug
       api.parameters["externalLinkLabel"] = branchSlug
       api.parameters["externalLinkUrl"] = "$branchSlug.app.openpra.org"
     }
   }

   host("Build") {

     requirements {
       workerTags("swarm-worker")
     }

     shellScript("build-image"){
       interpreter = "/bin/bash"
       content = """
                           docker pull $remote:deploy-{{ branchSlug }} || true
                           docker build --build-arg BUILD_TYPE="{{ buildType }}" --tag="$remote:deploy-{{ branchSlug }}" -f ./docker/Dockerfile .
                           docker push "$remote:deploy-{{ branchSlug }}"
                           """
     }
   }

   host("Stack Update") {

     requirements {
       workerTags("swarm-manager")
     }

     env["STACK_YML"] = "docker/stack.yml"

     env["IMAGE_BACKEND"] = "$remote:deploy-{{ branchSlug }}"

     env["APP_NAME"] = "v2-app-{{ branchSlug }}"
     env["HOST_URL"] = "{{ branchSlug }}.{{ project:APP_DOMAIN }}"
     env["NUM_WORKERS"] = "{{ numWorkers }}"

     env["CI_SENTRY_DSN"] = "{{ project:APP_SENTRY_DSN }}"
     env["CI_SENTRY_ENV"] = "{{ project:APP_SENTRY_ENV }}"
     env["CI_DEBUG"] = "{{ project:APP_DEBUG_MODE }}"

     env["ENV_SHARED_VOLUME_PATH"] = "{{ project:SHARED_VOLUME_PATH }}/openpra-app/v2/{{ branchSlug }}/volumes"

     // secrets
     env["DSF_JWT_SECRET_KEY"] = "{{ project:APP_JWT_SECRET_KEY }}"

     shellScript("create directories"){
       interpreter = "/bin/bash"
       content = """
                         mkdir -p ${'$'}ENV_SHARED_VOLUME_PATH/mongodb ${'$'}ENV_SHARED_VOLUME_PATH/rabbitmq docker/secrets
                         """
     }

     shellScript("write secret files"){
       interpreter = "/bin/bash"
       content = """
                         echo ${'$'}DSF_JWT_SECRET_KEY > docker/secrets/DSF_JWT_SECRET_KEY.secret
                         """
     }

     shellScript("docker stack deploy"){
       interpreter = "/bin/bash"
       content = """
                             docker compose -f ${'$'}STACK_YML config
                             docker stack deploy -c ${'$'}STACK_YML --with-registry-auth ${'$'}APP_NAME
                             """
     }

     kotlinScript("update deployments target") { api ->

       val label: String? = api.parameters["externalLinkLabel"]
       val url: String = "https://" + api.parameters["externalLinkUrl"]!!
       val externalLink = ExternalLink(label, url)

       api.space().projects.automation.deployments.start(
         project = api.projectIdentifier(),
         targetIdentifier = TargetIdentifier.Key("v2-app"),
         version = label + "-" + api.executionNumber(),
         syncWithAutomationJob = true,
         externalLink = externalLink
       )
     }
   }
 }

job("Monorepo Deployment Cleanup") {

  startOn {
    codeReviewClosed{
      branchToCheckout = CodeReviewBranch.MERGE_REQUEST_SOURCE
    }
  }

  host("Deployment Tags") {
    // use kotlinScript blocks for usage of parameters
    kotlinScript("Generate slugs") { api ->

      api.parameters["commitRef"] = api.gitRevision()
      api.parameters["gitBranch"] = api.gitBranch()

      val branchName = api.gitBranch()
        .removePrefix("refs/heads/")
        .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
        .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
        .lowercase() // Convert to lower case for consistency

      val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

      var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

      if (branchName == "main") {
        branchSlug = "v2"
        api.parameters["buildType"] = "production"
        api.parameters["debugMode"] = "false"
        api.parameters["isReview"] = "false"
      } else {
        branchSlug = "review-$branchSlug"
        api.parameters["buildType"] = "development"
        api.parameters["debugMode"] = "true"
        api.parameters["isReview"] = "true"
      }

      api.parameters["branchSlug"] = branchSlug
      api.parameters["externalLinkLabel"] = branchSlug
      api.parameters["externalLinkUrl"] = "$branchSlug.app.openpra.org"
    }
  }

  host("Remove Stack") {
    requirements {
      workerTags("swarm-manager")
    }

    env["APP_NAME"] = "v2-app-{{ branchSlug }}"

    shellScript("docker stack rm"){
      interpreter = "/bin/bash"
      content = """
                             docker stack rm ${'$'}APP_NAME
                             """
    }
  }
}

job("Monorepo CI") {

    failOn {
        nonZeroExitCode { enabled = true }
    }

    requirements {
      workerTags("swarm-worker")
    }

    val registry = "packages-space.openpra.org/p/openpra/containers/"
    val image = "openpra-monorepo"
    val remote = "$registry$image"

     host("Image Tags") {
       // use kotlinScript blocks for usage of parameters
       kotlinScript("Generate slugs") { api ->

         api.parameters["commitRef"] = api.gitRevision()
         api.parameters["gitBranch"] = api.gitBranch()

         val branchName = api.gitBranch()
           .removePrefix("refs/heads/")
           .replace(Regex("[^A-Za-z0-9-]"), "-") // Replace all non-alphanumeric characters except hyphens with hyphens
           .replace(Regex("-+"), "-") // Replace multiple consecutive hyphens with a single hyphen
           .lowercase() // Convert to lower case for consistency

         val maxSlugLength = if (branchName.length > 32) 32 else branchName.length

         var branchSlug = branchName.subSequence(0, maxSlugLength).toString()

         if (branchName == "main") {
           branchSlug = "v2"
           api.parameters["buildType"] = "production"
           api.parameters["debugMode"] = "false"
           api.parameters["isReview"] = "false"
         } else {
           branchSlug = "review-$branchSlug"
           api.parameters["buildType"] = "development"
           api.parameters["debugMode"] = "true"
           api.parameters["isReview"] = "true"
         }

         api.parameters["branchSlug"] = branchSlug
         api.parameters["externalLinkLabel"] = branchSlug
         api.parameters["externalLinkUrl"] = "$branchSlug.app.openpra.org"
       }
     }

    host("build-image") {
      shellScript {
        interpreter = "/bin/bash"
        content = """
                        docker pull $remote:{{ branchSlug }} || true
                        docker build --tag="$remote:{{ branchSlug }}" --tag="$remote:ci-{{ run:number }}-{{ branchSlug }}" -f ./docker/Dockerfile .
                        docker push "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                        """
      }
    }

    parallel {

      host("frontend-web-editor:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:build
                      """
        }
      }

      host("frontend-web-editor:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:test || true
                      """
        }
      }

      host("frontend-web-editor:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:e2e-cli || true
                      """
        }
      }

      host("frontend-web-editor:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run frontend-web-editor:lint || true
                      """
        }
      }


      host("web-backend:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:build
                        """
        }
      }

      host("web-backend:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:test || true
                        """
        }
      }

      host("web-backend:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:e2e || true
                        """
        }
      }

      host("web-backend:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run web-backend:lint || true
                        """
        }
      }

      host("shared-types:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:build
                        """
        }
      }

      host("shared-types:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:test
                        """
        }
      }

      host("shared-types:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run shared-types:lint || true
                        """
        }
      }

      host("model-generator:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:build
                        """
        }
      }

      host("model-generator:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:test
                        """
        }
      }

      host("model-generator:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run model-generator:lint
                        """
        }
      }

      host("scram-node:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:build
                        """
        }
      }

      host("scram-node:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:test
                        """
        }
      }

      host("scram-node:ctest") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:ctest
                        """
        }
      }

      host("scram-node:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run engine-scram-node:lint
                        """
        }
      }

      host("mef-schema:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:build
                        """
        }
      }

      host("mef-schema:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:test
                        """
        }
      }

      host("mef-schema:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run mef-schema:lint
                        """
        }
      }

      host("microservice-job-broker:build") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:build
                        """
        }
      }

      host("microservice-job-broker:test") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:test
                        """
        }
      }

      host("microservice-job-broker:e2e") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:e2e
                        """
        }
      }

      host("microservice-job-broker:lint") {
        shellScript {
          interpreter = "/bin/bash"
          content = """
                      docker pull "$remote:ci-{{ run:number }}-{{ branchSlug }}"
                      docker run --rm "$remote:ci-{{ run:number }}-{{ branchSlug }}" nx run microservice-job-broker:lint
                        """
        }
      }
    }
}
