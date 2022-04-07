variable "region" {
  default = "us-east-2"
}

variable "namespace" {
   default = "rtdb3"
}

variable "tag" {
   default = "latest"
}

variable "repository" {
   defafult = "public.ecr.aws/d5y7k0n6/rtdb"
}

variable "app_version" {
  type = map
  description = "version to deploy"
}


