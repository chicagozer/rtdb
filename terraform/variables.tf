variable "region" {
  default = "us-east-2"
}

variable "namespace" {
   default = "rtdb3"
}

variable "tag" {
   default = "latest"
}

variable "app_version" {
  type = map
  description = "version to deploy"
}


