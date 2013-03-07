Logentries on OpenShift
======================

This git repo provides a quick method to get your OpenShift logs streaming to Logentries.

Running on OpenShift
----------------------------

Create a Logentries account at https://logentries.com/doc/openshift/

Take note of the Account-Key that you are given, you will need it in the Configuration step below. If you have already created an account and haven't taken note of your account key, you can retrieve it following these instructions: 
https://logentries.com/doc/accountkey/

Add the upstream Logentries repo to the Openshift app (called 'myappname' in the example below) that you want Logentries to manage the logs of: 

	cd myappname
	git remote add upstream -m master https://github.com/logentries/le_openshift.git
	git pull -s recursive -X theirs upstream master

If you haven't got an Openshift app already setup, please refer to the Openshift documentation first (e.g. https://openshift.redhat.com/community/get-started).

Configuration
-------------

Configure logentries/le_config.ini file with your Logentries Account Key. For this, simply paste the key inside the quotation marks in logentries/le_config.ini

Then push the repo

	git add .
	git commit -m "my first commit"
	git push

That's it, you can now run your app and check your logs, by logging into your Logentries account and refreshing the page.
